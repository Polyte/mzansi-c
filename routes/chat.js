const express = require('express');
const Chat = require('../models/Chat');
const Ride = require('../models/Ride');
const { protect } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/chat
// @desc    Create or get chat for a ride
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    const { rideId } = req.body;

    if (!rideId) {
      return res.status(400).json({ message: 'Ride ID is required' });
    }

    const ride = await Ride.findById(rideId)
      .populate('rider', 'name')
      .populate('driver', 'name');

    if (!ride) {
      return res.status(404).json({ message: 'Ride not found' });
    }

    // Check if user is part of this ride
    const isRider = ride.rider._id.toString() === req.user.id;
    const isDriver = ride.driver && ride.driver._id.toString() === req.user.id;

    if (!isRider && !isDriver) {
      return res.status(403).json({ message: 'Not authorized for this ride' });
    }

    // Find or create chat
    let chat = await Chat.findOne({ ride: rideId });

    if (!chat) {
      const participants = [ride.rider._id];
      if (ride.driver) {
        participants.push(ride.driver._id);
      }

      chat = await Chat.create({
        ride: rideId,
        participants,
        messages: []
      });
    }

    res.json(chat);
  } catch (error) {
    console.error('Chat creation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/chat/:chatId/message
// @desc    Send a message
// @access  Private
router.post('/:chatId/message', protect, async (req, res) => {
  try {
    const { message, type, location } = req.body;
    const { chatId } = req.params;

    if (!message && !location) {
      return res.status(400).json({ message: 'Message or location is required' });
    }

    const chat = await Chat.findById(chatId);

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    // Check if user is a participant
    const isParticipant = chat.participants.some(
      p => p.toString() === req.user.id
    );

    if (!isParticipant) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Add message
    const newMessage = {
      sender: req.user.id,
      message: message || '',
      type: type || 'text',
      location: location || null,
      readBy: [],
      createdAt: new Date()
    };

    chat.messages.push(newMessage);
    chat.lastMessage = {
      message: message || 'Location shared',
      sender: req.user.id,
      timestamp: new Date()
    };

    await chat.save();

    // Emit via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(`chat-${chatId}`).emit('new-message', {
        chatId,
        message: newMessage
      });
    }

    res.json({
      message: 'Message sent',
      chatMessage: newMessage
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/chat/:chatId
// @desc    Get chat messages
// @access  Private
router.get('/:chatId', protect, async (req, res) => {
  try {
    const { chatId } = req.params;

    const chat = await Chat.findById(chatId)
      .populate('messages.sender', 'name avatar')
      .populate('participants', 'name avatar');

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    // Check if user is a participant
    const isParticipant = chat.participants.some(
      p => p._id.toString() === req.user.id
    );

    if (!isParticipant) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    res.json(chat);
  } catch (error) {
    console.error('Get chat error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/chat/:chatId/read
// @desc    Mark messages as read
// @access  Private
router.put('/:chatId/read', protect, async (req, res) => {
  try {
    const { chatId } = req.params;

    const chat = await Chat.findById(chatId);

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    // Mark all unread messages as read
    chat.messages.forEach(msg => {
      const alreadyRead = msg.readBy.some(
        r => r.user.toString() === req.user.id
      );
      if (!alreadyRead) {
        msg.readBy.push({
          user: req.user.id,
          readAt: new Date()
        });
      }
    });

    await chat.save();

    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

