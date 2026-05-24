import { Component } from '@angular/core';
import { Message, SystemMessageType } from '@shared/types';
import { ChatMessagesComponent } from 'app/chat-messages/chat-messages.component';
import { ChatToolbarComponent } from 'app/chat-toolbar/chat-toolbar.component';

@Component({
  selector: 'app-software-coach',
  imports: [ChatToolbarComponent, ChatMessagesComponent],
  templateUrl: './software-coach.component.html',
  styleUrl: './software-coach.component.css'
})
export class SoftwareCoachComponent {
  messages: Message[] = [];
  systemMessageType: SystemMessageType = 'software-architecture-coach';


  onMessagesChanged(messages: Message[]) {
    this.messages = messages;
  }
}
